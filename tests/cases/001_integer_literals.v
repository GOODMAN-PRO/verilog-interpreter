module tb;
  reg [15:0] binary_value, octal_value, decimal_value, hex_value;
  reg [15:0] extended_x, extended_z;
  initial begin
    binary_value = 16'b1010_0101_0011_1100;
    octal_value = 16'o12_345;
    decimal_value = 16'd12_345;
    hex_value = 16'hAb_cD;
    extended_x = 8'hx;
    extended_z = 8'h?;
    $display("bases %h %h %h %h", binary_value, octal_value, decimal_value, hex_value);
    $display("unsized %0d %h %o %b", 42, 'h2a, 'o52, 'b101010);
    $display("unknown %b %b %b", 8'b10xz_01?0, extended_x, extended_z);
    $display("digits %b %b %b", 12'hx5z, 12'o?7x, 8'b?1);
    $finish;
  end
endmodule
