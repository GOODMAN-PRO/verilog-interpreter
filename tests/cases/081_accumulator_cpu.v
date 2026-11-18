`timescale 1ns/1ps
module accumulator(input clk, rst, output reg [7:0] acc,
                   output reg [3:0] pc, output reg halted);
  reg [7:0] rom [0:15];
  wire [7:0] instruction = rom[pc];
  integer i;
  initial begin
    for (i = 0; i < 16; i = i + 1) rom[i] = 0;
    rom[0] = 8'h13; rom[1] = 8'h31; rom[2] = 8'h56; rom[3] = 8'h41;
    rom[6] = 8'h15; rom[7] = 8'h23; rom[8] = 8'h6f; rom[9] = 8'h00;
  end
  always @(posedge clk) begin
    if (rst) begin acc <= 0; pc <= 0; halted <= 0; end
    else if (!halted) begin
      pc <= pc + 1'b1;
      case (instruction[7:4])
        0: begin halted <= 1; pc <= pc; end
        1: acc <= {4'b0, instruction[3:0]};
        2: acc <= acc + instruction[3:0];
        3: acc <= acc - instruction[3:0];
        4: pc <= instruction[3:0];
        5: if (acc == 0) pc <= instruction[3:0];
        6: acc <= acc ^ {4'b0, instruction[3:0]};
        default: halted <= 1;
      endcase
    end
  end
endmodule
module tb;
  reg clk, rst;
  wire [7:0] acc;
  wire [3:0] pc;
  wire halted;
  integer cycle;
  accumulator dut(clk, rst, acc, pc, halted);
  always #5 clk = ~clk;
  initial begin
    clk = 0; rst = 1; cycle = 0;
    @(posedge clk); #1; $display("reset pc=%0d acc=%0d halted=%b", pc, acc, halted);
    @(negedge clk); rst = 0;
    while (!halted && cycle < 20) begin
      @(posedge clk); #1;
      $display("cycle=%0d pc=%0d acc=%0d halted=%b", cycle, pc, acc, halted);
      cycle = cycle + 1;
    end
    repeat (2) begin @(posedge clk); #1; $display("hold pc=%0d acc=%0d halted=%b", pc, acc, halted); end
    $finish;
  end
endmodule
