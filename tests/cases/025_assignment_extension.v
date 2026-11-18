module tb;
  reg signed [7:0] signed_byte;
  reg [7:0] unsigned_byte;
  reg signed [15:0] signed_destination;
  reg [15:0] from_signed, from_unsigned, from_select, from_concat;
  initial begin
    signed_byte = -5;
    unsigned_byte = signed_byte;
    signed_destination = unsigned_byte;
    from_signed = signed_byte;
    from_unsigned = unsigned_byte;
    from_select = signed_byte[7:0];
    from_concat = {signed_byte};
    $display("extend %h %h %h %h %h", signed_destination, from_signed, from_unsigned, from_select, from_concat);
    signed_byte = 8'bx100_0011;
    from_signed = signed_byte;
    from_unsigned = $unsigned(signed_byte);
    $display("x_extend %b %b", from_signed, from_unsigned);
    signed_byte = 8'bz100_0011;
    from_signed = signed_byte;
    from_unsigned = $unsigned(signed_byte);
    $display("z_extend %b %b", from_signed, from_unsigned);
    $finish;
  end
endmodule
