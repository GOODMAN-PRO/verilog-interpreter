module tb;
  reg [7:0] a, b;
  initial begin
    a = 8'b1010_xxzz;
    b = 8'b1100_0101;
    $display("input %b %b", a, b);
    $display("and %b or %b", a & b, a | b);
    $display("xor %b xnor %b %b", a ^ b, a ~^ b, a ^~ b);
    $display("not %b", ~a);
    a = 8'bxz01_xz01;
    b = 8'bzx10_xz01;
    $display("states %b %b %b %b", a & b, a | b, a ^ b, a ~^ b);
    $display("mask0 %b mask1 %b", a & 8'h00, a | 8'hff);
    $display("identity %b %b", a & 8'hff, a | 8'h00);
    $finish;
  end
endmodule
