const path = require("path");
const process = require("process");
const child_process = require("child_process");

const cwd = process.cwd();
const testsPath = path.join(cwd, "/client/out/test");
const testsFixturePath = path.join(cwd, "/client/testFixture");
const vscodeTest = path.join(
  process.cwd(),
  "/client/node_modules/vscode/bin/test"
);

const options = {
    env: {
        CODE_TESTS_PATH: testsPath,
        CODE_TESTS_WORKSPACE: testsFixturePath
    }    
};

child_process.fork(vscodeTest, [], options);