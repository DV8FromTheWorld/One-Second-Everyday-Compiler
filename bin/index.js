#!/usr/bin/env node

const runCompliation = require("../src");

;(async () => {
  try {
    await runCompliation()
  }
  catch (err) {
    console.log('\n')
    console.error("Encountered error when attempting video compilation:")
    console.error(err)
  }
})();