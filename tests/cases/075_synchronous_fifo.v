`timescale 1ns/1ps
module fifo(input clk, rst, wr, rd, input [7:0] din,
            output reg [7:0] dout, output full, empty, output reg [2:0] count);
  reg [7:0] memory [0:3];
  reg [1:0] head, tail;
  wire put, get;
  assign full = count == 4;
  assign empty = count == 0;
  assign put = wr && !full;
  assign get = rd && !empty;
  always @(posedge clk) begin
    if (rst) begin head <= 0; tail <= 0; count <= 0; dout <= 0; end
    else begin
      if (put) begin memory[tail] <= din; tail <= tail + 1'b1; end
      if (get) begin dout <= memory[head]; head <= head + 1'b1; end
      case ({put, get})
        2'b10: count <= count + 1'b1;
        2'b01: count <= count - 1'b1;
        default: count <= count;
      endcase
    end
  end
endmodule
module tb;
  reg clk, rst, wr, rd;
  reg [7:0] din;
  wire [7:0] dout;
  wire full, empty;
  wire [2:0] count;
  fifo dut(clk, rst, wr, rd, din, dout, full, empty, count);
  always #5 clk = ~clk;
  task step;
    input w, r;
    input [7:0] d;
    begin
      @(negedge clk); wr = w; rd = r; din = d;
      @(posedge clk); #1;
      $display("wr=%b rd=%b din=%h dout=%h count=%0d full=%b empty=%b", w, r, d, dout, count, full, empty);
    end
  endtask
  initial begin
    clk = 0; rst = 1; wr = 0; rd = 0; din = 0;
    @(negedge clk); rst = 0;
    step(0, 1, 0);
    step(1, 0, 8'h11); step(1, 0, 8'h22); step(1, 0, 8'h33); step(1, 0, 8'h44);
    step(1, 0, 8'hee); step(1, 1, 8'hff); step(1, 1, 8'h55);
    step(0, 1, 0); step(0, 1, 0); step(0, 1, 0); step(0, 1, 0);
    step(1, 1, 8'h66); step(1, 1, 8'h77); step(0, 1, 0); step(0, 1, 0);
    $finish;
  end
endmodule
