module.exports = {
	"env": {
		"browser": true,
		"es2021": true
	},
	globals: {
		'luxon': 'readonly',
		'XLSX': 'readonly',
		'jspdf': 'readonly'
	},
	"extends": "eslint:recommended",
	"parserOptions": {
		"ecmaVersion": "latest",
		"sourceType": "module"
	},
	"plugins": ["only-warn"],
	"rules": {
		"semi": "error",
		"indent": ["error", "tab", {VariableDeclarator:0, "SwitchCase": 1}],
		"no-unused-vars": ["warn", { "vars": "all", "args": "none", "ignoreRestSiblings": false }],
		"no-fallthrough": "off",
		"no-inner-declarations": "off",
	}
}
