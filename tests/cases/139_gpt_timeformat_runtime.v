`timescale 1ns/1ns
module top;
  integer digits;
  reg [15:0] unit_name;
  initial begin
    digits=1; unit_name="ns";
    $timeformat(-9,digits,unit_name,0);
    #2 $display("%t",$time);
  end
endmodule
