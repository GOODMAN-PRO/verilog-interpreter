module tb;
  reg [7:0] bits;
  reg signed [7:0] signed_bits;
  reg [15:0] extended_signed, extended_unsigned;
  reg signed [15:0] sum;
  initial begin
    bits = 8'hf8;
    signed_bits = bits;
    extended_signed = $signed(bits);
    extended_unsigned = $unsigned(signed_bits);
    sum = $signed(bits) + 16'sd10;
    $display("cast %0d %0d", $signed(bits), $unsigned(signed_bits));
    $display("extend %h %h sum=%0d", extended_signed, extended_unsigned, sum);
    $display("compare %b %b", $signed(bits) < 0, $unsigned(signed_bits) < 0);
    $display("shift %b %b", $signed(bits) >>> 2, $unsigned(signed_bits) >>> 2);
    $display("sizes %0d %0d", $bits($signed(bits)), $bits($unsigned(signed_bits)));
    $finish;
  end
endmodule
