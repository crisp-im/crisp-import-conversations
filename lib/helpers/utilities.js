var TEMPORIZE_DELAY = 500; // 500 milliseconds

/**
 * Runs tasks serially
 * @public
 * @param  {object} tasks
 * @return {object} Promise object
 */
var runSerial = (tasks) => {
  let _result = Promise.resolve();

  tasks.forEach((task) => {
    _result = _result.then(() => task.fn(task.args));
  });

  return _result;
};

/**
 * Temporizes
 * @public
 * @param  {number} [delay]
 * @return {object} Promise object
 */
var temporize = (delay=null) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delay || TEMPORIZE_DELAY);
  });
};

// eslint-disable-next-line crisp/one-space-after-operator
module.exports = { runSerial, temporize };
