`timescale 1ns/1ps
module full_adder(input a, b, ci, output s, co);
  xor (s, a, b, ci);
  assign co = (a & b) | (a & ci) | (b & ci);
endmodule
module ripple #(parameter WIDTH = 8)(input [WIDTH-1:0] a, b, input ci,
                                    output [WIDTH-1:0] sum, output co);
  wire [WIDTH:0] carry;
  assign carry[0] = ci;
  assign co = carry[WIDTH];
  genvar g;
  generate for (g = 0; g < WIDTH; g = g + 1) begin: stage
    full_adder bit_adder(a[g], b[g], carry[g], sum[g], carry[g+1]);
  end endgenerate
endmodule
module tb;
  reg [7:0] a, b;
  reg ci;
  wire [7:0] sum;
  wire co;
  integer i;
  ripple #(.WIDTH(8)) dut(a, b, ci, sum, co);
  task check;
    input [7:0] av, bv;
    input cv;
    begin
      a = av; b = bv; ci = cv; #1;
      $display("%h+%h+%b=%b_%h mid=%b", a, b, ci, co, sum, dut.carry[4]);
    end
  endtask
  initial begin
    check(0, 0, 0); check(0, 0, 1); check(8'hff, 0, 1);
    check(8'hff, 8'hff, 1); check(8'h55, 8'haa, 0);
    for (i = 0; i < 8; i = i + 1) check((1 << i) - 1, 1, 0);
    check(8'hx0, 0, 0); check(8'h00, 8'h00, 1'bx);
    $finish;
  end
endmodule
