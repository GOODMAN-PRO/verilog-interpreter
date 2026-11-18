`timescale 1ns/1ps
module vending(input clk, rst, coin, output reg vend);
  reg credit, next;
  always @* begin
    next = credit; vend = 0;
    case (credit)
      1'b0: if (coin) next = 1;
      1'b1: if (coin) begin next = 0; vend = 1; end
      default: next = 0;
    endcase
  end
  always @(posedge clk) if (rst) credit <= 0; else credit <= next;
endmodule
module tb;
  reg clk, rst, coin;
  wire vend;
  vending dut(clk, rst, coin, vend);
  always #5 clk = ~clk;
  task step;
    input c;
    begin
      @(negedge clk); coin = c;
      #1; $display("input=%b credit=%b vend=%b", coin, dut.credit, vend);
      @(posedge clk); #1; $display("clock credit=%b vend=%b", dut.credit, vend);
    end
  endtask
  initial begin
    clk = 0; rst = 1; coin = 0;
    @(negedge clk); rst = 0;
    step(0); step(1); step(0); step(1); step(0);
    step(1); step(1); step(1); step(0); step(1);
    $finish;
  end
endmodule
