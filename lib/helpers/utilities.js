var TEMPORIZE_DELAY = 500; // 500 milliseconds

/**
 * Runs tasks serially
 * @public
 * @param  {object} tasks
 * @return {object} Promise object
 */
var runSerial = (tasks) => {
  let result = Promise.resolve();

  tasks.forEach((task) => {
    result = result.then(() => task.fn(task.args));
  });

  return result;
};

/**
 * Temporizes
 * @public
 * @param  {number} [delay]
 * @return {object} Promise object
 */
var temporize = (delay = null) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delay || TEMPORIZE_DELAY);
  });
};

module.exports = { runSerial, temporize };
