`timescale 1ns/1ps
module tb;
  real x,y;
  reg [8*8-1:0] text;
  initial begin: scope
    x=-12.375; y=0.000125; text="Verilog";
    $display("real %e %f %g",x,x,x);
    $display("precise %.2e %.3f %.4g",y,x,y);
    $display("width |%12.2f|%12.2e|",x,x);
    $display("string |%s|%10s|%0s|",text,text,text);
    $display("scope %m");
    #1.25;
    $timeformat(-9,2," ns",9);
    $display("time |%t|%0t| percent=%%",$realtime,$realtime);
    $display("zero %e %f %g",0.0,0.0,0.0);
    $finish;
  end
endmodule
