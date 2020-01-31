import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
  console.log('----------------------');
  console.log(111);
  console.log('----------------------');

  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd'
  });

  console.log('----------------------');
  console.log(222);
  console.log('----------------------');

  mocha.useColors(true);

  console.log('----------------------');
  console.log(333);
  console.log('----------------------');

  const testsRoot = path.resolve(__dirname, '..');

  console.log('----------------------');
  console.log(444);
  console.log('----------------------');

  return new Promise((c, e) => {
    console.log('----------------------');
    console.log(555);
    console.log('----------------------');

    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      console.log('----------------------');
      console.log(666);
      console.log('----------------------');

      if (err) {
        console.log('glob----------------------');
        console.log(err);
        console.log('----------------------');

        return e(err);
      }

      console.log('----------------------');
      console.log(777);
      console.log('----------------------');

      // Add files to the test suite
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

      console.log('----------------------');
      console.log(888);
      console.log('----------------------');

      try {
        // Run the mocha test
        mocha.run(failures => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            console.log('----------------------');
            console.log(990);
            console.log('----------------------');
            c();
          }
        });
      } catch (err) {
        console.log('errerrerr----------------------');
        console.log(err);
        console.log('----------------------');
        e(err);
      }
    });
  });
}
