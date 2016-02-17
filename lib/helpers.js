function funcInitProgressBar(){
  return function initProgressBar(progressBar){
    progressBar = new ProgressBar('Progress [:bar] :percent :elapseds', {
      total: batches.length + 1
    });
  };
}

function funcAdvanceProgress(progressBar){
  return function advanceProgress(){
    progressBar.tick();
  };
}

function funcCreateSuccessLogger(item, advanceProgress){
  return function logSuccess(results){
    advanceProgress();
    if (results){
      console.log('created', item, 'successfully');
    }
  };
}

function funcCreateErrorLogger(item){
  return function handleError(err){
    console.log('creating', item, 'failed');
    console.log('because', err.stack);
  };
}

function funcSplitBatches(initProgressBar){
  return function splitBatches(items){
    var batches = _.chunk(items, 400);
    initProgressBar(batches);
    return batches;
  };
}

function funcDebugLogger(){
  return function debugLogger(x){
    console.log(x);
  };
}

module.exports = {
  funcInitProgressBar: funcInitProgressBar,
  funcAdvanceProgress: funcAdvanceProgress,
  funcCreateSuccessLogger: funcCreateSuccessLogger,
  funcCreateErrorLogger: funcCreateErrorLogger,
  funcSplitBatches: funcSplitBatches,
  funcDebugLogger: funcDebugLogger
};
