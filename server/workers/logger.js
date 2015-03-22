module.exports = function joblogger(job, msg1, msg2, msg3){
    console.log("[JOB] "+job.name+": ",  msg1, msg2 ||"", msg3 ||"");
}