`timescale 1ns/1ps
module t; integer u, p; initial begin u=-9; p=2; #1.5;
$timeformat(u, p, " ns", 10); $display("[%t]", $realtime); end endmodule
