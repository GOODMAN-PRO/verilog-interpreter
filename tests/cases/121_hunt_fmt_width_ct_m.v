`timescale 1ns/1ps
module t; initial begin #3 $timeformat(-9,0," ns",8); $display("[%-t][%5c][%8m]", $time, "A"); end endmodule
