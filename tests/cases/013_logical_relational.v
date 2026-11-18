module tb;
  reg [3:0] a, b;
  reg signed [3:0] sa, sb;
  initial begin
    a = 4'b0x00;
    b = 4'b0000;
    $display("unknown_zero %b %b %b %b", !a, !b, a && b, a || b);
    b = 4'b100x;
    $display("unknown_true %b %b %b", !b, a && b, a || b);
    a = 4'bzzzz;
    $display("z %b %b %b", !a, a && 1'b1, a || 1'b0);
    a = 4'd9;
    b = 4'd6;
    sa = -7;
    sb = 6;
    $display("unsigned %b %b %b %b", a < b, a <= b, a > b, a >= b);
    $display("signed %b %b %b %b", sa < sb, sa <= sb, sa > sb, sa >= sb);
    $display("equal %b %b %b %b", a < a, a <= a, a > a, a >= a);
    a = 4'bx001;
    $display("unknown_rel %b %b %b %b", a < b, a <= b, a > b, a >= b);
    $finish;
  end
endmodule
