const { randomBytes, scryptSync } = require('node:crypto');
const readline = require('node:readline');

if (!process.stdin.isTTY) {
  process.stderr.write('Ejecuta este comando en una terminal interactiva.\n');
  process.exit(1);
}
const input = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
input.stdoutMuted = true;
input._writeToOutput = function (value) {
  this.output.write(value.includes('Contraseña') ? value : '*'.repeat(value.length));
};
input.question('Contraseña del administrador: ', (password) => {
  input.close();
  if (password.length < 12) {
    process.stderr.write('\nUsa al menos 12 caracteres.\n');
    process.exitCode = 1;
    return;
  }
  const salt = randomBytes(16);
  process.stdout.write(`\nADMIN_PASSWORD_HASH=scrypt:${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}\n`);
});
