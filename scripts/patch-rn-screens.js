const fs = require('fs');
const path = require('path');
const glob = require('glob');

const root = path.resolve(__dirname, '..', 'node_modules', 'react-native-screens');
const patterns = [
  'src/**/*.ts',
  'lib/typescript/**/*.d.ts',
];

const mapType = (t) => {
  t = t.trim();
  if (/^CT\.Int32$/.test(t) || /^CT\.Float$/.test(t)) {return 'number';}
  if (/^OptionalBoolean$/.test(t)) {return 'boolean | undefined';}
  return t;
};

patterns.forEach((pat) => {
  const files = glob.sync(path.join(root, pat), { nodir: true });
  files.forEach((file) => {
    let src = fs.readFileSync(file, 'utf8');
    const re = /CT\.WithDefault<([^,>]+),\s*[^>]+>/g;
    let changed = false;
    src = src.replace(re, (_, p1) => {
      const mapped = mapType(p1);
      changed = true;
      return `${mapped} | undefined`;
    });
    if (changed) {
      fs.writeFileSync(file, src, 'utf8');
      console.log('Patched', file);
    }
  });
});

console.log('Done');
