function initProgressBar(progressBar) {
  progressBar = new ProgressBar('Progress [:bar] :percent :elapseds', {
    total: batches.length + 1
  });
}

function advanceProgress(progressBar) {
  progressBar.tick();
}

function logSuccess(item, advanceProgress, results) {
  advanceProgress();
  if (results) {
    console.log('created', item, 'successfully');
  }
}

function handleError(item, err) {
  console.log('creating', item, 'failed');
  console.log('because', err.stack);
}

function splitBatches(initProgressBar, items) {
  var batches = _.chunk(items, 400);
  initProgressBar(batches);
  return batches;
}

function debugLogger(x) {
  console.log(x);
}

module.exports = {
  initProgressBar: initProgressBar,
  advanceProgress: advanceProgress,
  logSuccess: logSuccess,
  handleError: handleError,
  splitBatches: splitBatches,
  debugLogger: debugLogger
};
