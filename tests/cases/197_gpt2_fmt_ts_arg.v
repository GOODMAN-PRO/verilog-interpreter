`timescale 1ns/1ps
module child; endmodule
`timescale 1us/1ns
module top; child u(); initial $printtimescale(u); endmodule
