module tb;
  reg [63:0] shifted, positive_hex, negative_decimal, inverted, added;
  reg [31:0] narrow_shift;
  reg signed [63:0] signed_wide;
  initial begin
    shifted = 1 << 40;
    narrow_shift = 1 << 40;
    positive_hex = 'hffffffff;
    negative_decimal = -1;
    inverted = ~0;
    added = 64'h100000000 + 1;
    signed_wide = 'shffffffff;
    $display("shift wide=%h narrow=%h", shifted, narrow_shift);
    $display("extend hex=%h decimal=%h signedhex=%h", positive_hex, negative_decimal, signed_wide);
    $display("wide invert=%h add=%h", inverted, added);
    $display("mixed_unary=%h signed_literal=%h", 64'd0 + -1, 64'd0 + -32'sd1);
    $finish;
  end
endmodule
