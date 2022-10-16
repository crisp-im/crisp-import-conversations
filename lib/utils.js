/**
 * Runs tasks serially
 * @private
 * @param  {object} tasks
 * @return {object} Promise object
 */
var runSerial = (tasks) => {
  let result = Promise.resolve();

  tasks.forEach(task => {
    result = result.then(() => task.fn(task.arg));
  });

  return result;
};

module.exports = { runSerial };
