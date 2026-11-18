`timescale 1ns/1ps
module alu(input [7:0] a, b, input [3:0] op,
           output reg [7:0] y, output reg carry, output zero);
  always @* begin
    carry = 0; y = 0;
    case (op)
      0: {carry, y} = a + b;
      1: {carry, y} = a - b;
      2: y = a & b;
      3: y = a | b;
      4: y = a ^ b;
      5: y = ~a;
      6: y = a << b[2:0];
      7: y = a >> b[2:0];
      8: y = $signed(a) >>> b[2:0];
      9: y = a < b;
      10: y = $signed(a) < $signed(b);
      11: y = a == b;
      default: y = 8'h00;
    endcase
  end
  assign zero = y == 0;
endmodule
module tb;
  reg [7:0] a, b;
  reg [3:0] op;
  wire [7:0] y;
  wire carry, zero;
  integer i;
  alu dut(a, b, op, y, carry, zero);
  task show;
    begin #1; $display("a=%h b=%h op=%0d y=%h c=%b z=%b", a, b, op, y, carry, zero); end
  endtask
  initial begin
    a = 8'hf0; b = 8'h13;
    for (i = 0; i <= 12; i = i + 1) begin op = i; show; end
    a = 8'hff; b = 1; op = 0; show;
    a = 0; b = 1; op = 1; show;
    a = 8'h80; b = 8'h7f; op = 10; show;
    b = a; op = 11; show;
    a = 8'hx0; b = 0; op = 2; show;
    a = 8'hxz; b = 8'hff; op = 3; show;
    $finish;
  end
endmodule
