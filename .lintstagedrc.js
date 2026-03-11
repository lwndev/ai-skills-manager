module.exports = {
  '*.ts': [
    'eslint --fix',
    'prettier --write',
  ],
  '*.yml': [
    'eslint --fix',
  ],
};
