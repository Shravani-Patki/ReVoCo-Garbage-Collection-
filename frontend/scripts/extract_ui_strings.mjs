import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;
const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '../src');
const catalogPath = path.join(sourceRoot, 'locales/en.json');
const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, 'utf8')) : {};
const sourceFiles = [];

const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (entry.name.endsWith('.jsx')) sourceFiles.push(fullPath);
    }
};

walk(sourceRoot);

const addKey = (text) => {
    const key = text.replace(/\s+/gu, ' ').trim();
    if (key && /\p{L}/u.test(key)) catalog[key] = key;
    return key;
};

const expression = (key) => `{t(${JSON.stringify(key)})}`;

for (const filePath of sourceFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
    const edits = [];
    const requiredImports = new Set(['t']);
    const relative = path.relative(sourceRoot, filePath).replaceAll('\\', '/');
    const i18nPath = relative === 'App.jsx' ? './i18n' : relative.startsWith('components/') ? '../i18n' : relative.startsWith('pages/') ? '../i18n' : './i18n';

    const addEdit = (start, end, replacement) => edits.push({ start, end, replacement });

    traverse(ast, {
        ImportDeclaration(importPath) {
            if (importPath.node.source.value === i18nPath && importPath.node.specifiers.some(specifier => specifier.imported?.name === 't')) {
                requiredImports.add('t');
            }
        },
        JSXText(textPath) {
            const raw = textPath.node.value;
            const key = addKey(raw);
            if (!key) return;
            const startsWithSpace = /^[\t ]+\S/u.test(raw);
            const endsWithSpace = /\S[\t ]+$/u.test(raw);
            const replacement = `${startsWithSpace ? "{' '}" : ''}${expression(key)}${endsWithSpace ? "{' '}" : ''}`;
            addEdit(textPath.node.start, textPath.node.end, replacement);
        },
        JSXAttribute(attributePath) {
            const name = attributePath.node.name.name;
            const value = attributePath.node.value;
            if (!['alt', 'aria-label', 'aria-description', 'placeholder', 'title'].includes(name)) return;
            if (value?.type !== 'StringLiteral') return;
            const key = addKey(value.value);
            if (key) addEdit(value.start, value.end, `{t(${JSON.stringify(key)})}`);
        },
        JSXExpressionContainer(containerPath) {
            if (containerPath.parentPath.isJSXAttribute()) {
                const attributeName = containerPath.parentPath.node.name.name;
                const node = containerPath.node.expression;
                if (attributeName === 'value' && node.type === 'CallExpression' && ['t', 'formatNumber', 'formatCurrency', 'formatDate'].includes(node.callee.name) && node.arguments[0]?.type === 'MemberExpression') {
                    const valueExpression = node.arguments[0];
                    addEdit(node.start, node.end, source.slice(valueExpression.start, valueExpression.end));
                }
                return;
            }
            const node = containerPath.node.expression;
            if (node.type === 'Identifier' && ['label', 'title', 'description', 'desc'].includes(node.name)) {
                addEdit(node.start, node.end, `t(${source.slice(node.start, node.end)})`);
                return;
            }
            if (node.type === 'MemberExpression' && !node.computed && ['label', 'title', 'description', 'desc', 'message'].includes(node.property.name)) {
                addEdit(node.start, node.end, `t(${source.slice(node.start, node.end)})`);
                return;
            }
            if (node.type === 'Identifier' && ['type', 'state', 'city'].includes(node.name) && containerPath.parent.type === 'JSXElement' && containerPath.parent.openingElement.name.name === 'option') {
                addEdit(node.start, node.end, `t(${source.slice(node.start, node.end)})`);
                return;
            }
            if (node.type === 'MemberExpression' && !node.computed) {
                const property = node.property.name;
                const original = source.slice(node.start, node.end);
                if (['status', 'material'].includes(property)) {
                    addEdit(node.start, node.end, `t(${original})`);
                } else if (['price', 'amount', 'pool_balance', 'total_rewards', 'credits'].includes(property)) {
                    requiredImports.add('formatCurrency');
                    addEdit(node.start, node.end, `formatCurrency(${original})`);
                } else if (['quantity', 'volume_estimated', 'total_recycled_volume', 'city_score', 'total_volume_reduced', 'total_donations', 'total_rewards_given'].includes(property)) {
                    requiredImports.add('formatNumber');
                    addEdit(node.start, node.end, `formatNumber(${original}, { maximumFractionDigits: 2 })`);
                } else if (property === 'effectiveDate') {
                    requiredImports.add('formatDate');
                    addEdit(node.start, node.end, `formatDate(${original})`);
                }
            }
        },
        CallExpression(callPath) {
            const callee = callPath.node.callee;
            if (callee.type === 'Identifier' && callee.name === 't' && callPath.node.arguments[0]?.type === 'StringLiteral') {
                addKey(callPath.node.arguments[0].value);
            }
            const toastCall = callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'toast';
            if (!toastCall) return;
            for (const argument of callPath.node.arguments) {
                if (argument.type === 'StringLiteral') {
                    const key = addKey(argument.value);
                    if (key) addEdit(argument.start, argument.end, `t(${JSON.stringify(key)})`);
                }
            }
        },
        ObjectProperty(propertyPath) {
            const propertyName = propertyPath.node.key.name || propertyPath.node.key.value;
            if (['label', 'title', 'desc', 'description', 'sub', 'unit', 'empty'].includes(propertyName) && propertyPath.node.value.type === 'StringLiteral') {
                addKey(propertyPath.node.value.value);
            }
            const call = propertyPath.findParent(parent => parent.isCallExpression());
            if (!call || call.node.callee.type !== 'MemberExpression' || call.node.callee.object.name !== 'toast') return;
            if (propertyPath.node.key.name !== 'render' || propertyPath.node.value.type !== 'StringLiteral') return;
            const key = addKey(propertyPath.node.value.value);
            if (key) addEdit(propertyPath.node.value.start, propertyPath.node.value.end, `t(${JSON.stringify(key)})`);
        },
        StringLiteral(stringPath) {
            const declaration = stringPath.findParent(parent => parent.isVariableDeclarator());
            if (declaration && ['WASTE_TYPES', 'LOCATIONS'].includes(declaration.node.id.name)) {
                addKey(stringPath.node.value);
            }
        },
    });

    const existingI18nImports = ast.program.body.filter(node => node.type === 'ImportDeclaration' && node.source.value === i18nPath);
    if (existingI18nImports.length) {
        const importedNames = new Set(existingI18nImports.flatMap(declaration => declaration.specifiers.filter(item => item.type === 'ImportSpecifier').map(item => item.imported.name)));
        requiredImports.forEach(name => importedNames.add(name));
        const replacement = `import { ${[...importedNames].join(', ')} } from ${JSON.stringify(i18nPath)};`;
        addEdit(existingI18nImports[0].start, existingI18nImports[0].end, replacement);
        existingI18nImports.slice(1).forEach(declaration => addEdit(declaration.start, declaration.end, ''));
    } else if (edits.length) {
        const imports = ast.program.body.filter(node => node.type === 'ImportDeclaration');
        const insertionPoint = imports.length ? imports.at(-1).end : 0;
        addEdit(insertionPoint, insertionPoint, `\nimport { ${[...requiredImports].join(', ')} } from ${JSON.stringify(i18nPath)};`);
    }

    edits.sort((first, second) => second.start - first.start || second.end - first.end);
    let output = source;
    for (const edit of edits) output = `${output.slice(0, edit.start)}${edit.replacement}${output.slice(edit.end)}`;
    if (output !== source) fs.writeFileSync(filePath, output);
}

fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
fs.writeFileSync(catalogPath, `${JSON.stringify(Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
console.log(`Localized ${sourceFiles.length} JSX files; extracted ${Object.keys(catalog).length} English strings.`);