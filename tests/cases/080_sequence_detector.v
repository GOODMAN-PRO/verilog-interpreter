`timescale 1ns/1ps
module sequence_1011(input clk, rst, bit_in, output reg detected);
  reg [1:0] state;
  always @(posedge clk) begin
    if (rst) begin state <= 0; detected <= 0; end
    else begin
      detected <= 0;
      case (state)
        0: state <= bit_in ? 1 : 0;
        1: state <= bit_in ? 1 : 2;
        2: state <= bit_in ? 3 : 0;
        3: begin state <= bit_in ? 1 : 2; detected <= bit_in; end
        default: state <= 0;
      endcase
    end
  end
endmodule
module tb;
  reg clk, rst, bit_in;
  reg [19:0] stream;
  wire detected;
  integer i, matches;
  sequence_1011 dut(clk, rst, bit_in, detected);
  always #5 clk = ~clk;
  initial begin
    clk = 0; rst = 1; bit_in = 0; matches = 0;
    stream = 20'b00101101101011001101;
    @(negedge clk); rst = 0;
    for (i = 19; i >= 0; i = i - 1) begin
      @(negedge clk); bit_in = stream[i];
      @(posedge clk); #1;
      if (detected) matches = matches + 1;
      $display("index=%0d bit=%b state=%0d detected=%b total=%0d", 19-i, bit_in, dut.state, detected, matches);
    end
    @(negedge clk); rst = 1;
    @(posedge clk); #1; $display("reset state=%0d detected=%b", dut.state, detected);
    $finish;
  end
endmodule
