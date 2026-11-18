`timescale 1ns/1ps
module barrel(input [7:0] data, input [2:0] amount, input rotate, right,
              output [7:0] result);
  wire [7:0] s0, s1, s2, s3;
  assign s0 = data;
  genvar g;
  generate for (g = 0; g < 3; g = g + 1) begin: stage
    localparam SHIFT = 1 << g;
    wire [7:0] source, shifted;
    if (g == 0) assign source = s0;
    else if (g == 1) assign source = s1;
    else assign source = s2;
    assign shifted = right ? ((source >> SHIFT) | (rotate ? source << (8-SHIFT) : 8'b0))
                           : ((source << SHIFT) | (rotate ? source >> (8-SHIFT) : 8'b0));
    if (g == 0) assign s1 = amount[g] ? shifted : source;
    else if (g == 1) assign s2 = amount[g] ? shifted : source;
    else assign s3 = amount[g] ? shifted : source;
  end endgenerate
  assign result = s3;
endmodule
module tb;
  reg [7:0] data;
  reg [2:0] amount;
  reg rotate, right;
  wire [7:0] result;
  integer mode, i;
  barrel dut(data, amount, rotate, right, result);
  initial begin
    data = 8'h96;
    for (mode = 0; mode < 4; mode = mode + 1) begin
      rotate = mode[1]; right = mode[0];
      for (i = 0; i < 8; i = i + 1) begin
        amount = i; #1;
        $display("rotate=%b right=%b amount=%0d result=%h", rotate, right, amount, result);
      end
    end
    $finish;
  end
endmodule
