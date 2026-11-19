`timescale 1ns/1ns
module t; real r;
initial begin
$display($realtime); #3 $display($realtime, "|", $time, "|", $stime);
r = $realtime; $display(r); $display($realtime * 2); $display("%0t|%t", $realtime, $realtime);
end endmodule
`timescale 10ns/1ps
module u; initial begin #1.25 $display($realtime); $display($realtime, $realtime); $write($realtime, "\n"); $strobe($realtime); end endmodule
`timescale 1us/1ns
module v; initial begin #2 $display($realtime); $timeformat(-9, 2, " ns", 12); $display($realtime); end endmodule
