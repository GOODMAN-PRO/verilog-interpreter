`timescale 1ns/1ps
module uart_tx(input clk, rst, start, input [7:0] data,
               output reg tx, busy, done);
  reg [9:0] frame;
  reg [3:0] bit_index;
  reg baud_count;
  always @(posedge clk) begin
    if (rst) begin tx <= 1; busy <= 0; done <= 0; frame <= 10'h3ff; bit_index <= 0; baud_count <= 0; end
    else begin
      done <= 0;
      if (!busy) begin
        tx <= 1;
        if (start) begin
          frame <= {1'b1, data, 1'b0}; tx <= 0; busy <= 1; bit_index <= 0; baud_count <= 0;
        end
      end else if (baud_count == 1) begin
        baud_count <= 0;
        if (bit_index == 9) begin tx <= 1; busy <= 0; done <= 1; end
        else begin frame <= {1'b1, frame[9:1]}; tx <= frame[1]; bit_index <= bit_index + 1'b1; end
      end else baud_count <= 1;
    end
  end
endmodule
module tb;
  reg clk, rst, start;
  reg [7:0] data;
  wire tx, busy, done;
  integer cycle;
  uart_tx dut(clk, rst, start, data, tx, busy, done);
  always #5 clk = ~clk;
  task step;
    input launch;
    input [7:0] byte_value;
    begin
      @(negedge clk); start = launch; data = byte_value;
      @(posedge clk); #1;
      $display("cycle=%0d start=%b tx=%b busy=%b done=%b bit=%0d", cycle, start, tx, busy, done, dut.bit_index);
      cycle = cycle + 1;
    end
  endtask
  initial begin
    clk = 0; rst = 1; start = 0; data = 0; cycle = 0;
    @(negedge clk); rst = 0;
    step(1, 8'ha5);
    repeat (5) step(0, 0);
    step(1, 8'hff);
    repeat (15) step(0, 0);
    step(1, 8'h3c);
    repeat (22) step(0, 0);
    $finish;
  end
endmodule
