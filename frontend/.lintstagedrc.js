// lint-staged configuration for TrendSiam frontend
// Runs ESLint on staged TypeScript/JavaScript files before commit

module.exports = {
  '**/*.{js,jsx,ts,tsx}': [
    'eslint --fix',
    'git add'
  ]
};

