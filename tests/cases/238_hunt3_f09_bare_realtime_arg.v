`timescale 1ns/1ps
module t;
initial begin
$display($realtime);
#1.5 $display($realtime);
$display($realtime, " ", $time);
end endmodule
