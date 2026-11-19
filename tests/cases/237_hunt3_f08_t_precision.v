`timescale 1ns/1ps
module t;
initial begin #2;
$display("[%.3t]", 5);
$display("[%.2t]", $realtime);
$display("[%8.2t]", 1500);
end endmodule
