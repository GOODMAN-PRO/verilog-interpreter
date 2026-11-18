`timescale 10ns/1ns
module tb;
  time saved;
  real precise;
  initial begin
    $timeformat(-9,1," ns",10);
    #0.26;
    saved=$time; precise=$realtime;
    $display("a time=%0d stime=%0d real=%.3f fmt=%0t",saved,$stime,precise,$realtime);
    #0.26;
    $display("b time=%0d stime=%0d real=%.3f fmt=%t",$time,$stime,$realtime,$realtime);
    #1.15;
    $display("c time=%0d real=%.3f",$time,$realtime);
    $timeformat(-6,3," us",0);
    $display("micro %t",$realtime);
    // The delay is in this module's 10 ns units; exercise 32-bit $stime wrap.
    #4294967296;
    $display("wide time=%0d stime=%0d",$time,$stime);
    $finish;
  end
endmodule
