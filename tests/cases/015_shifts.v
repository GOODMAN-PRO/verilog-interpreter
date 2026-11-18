module tb;
  reg signed [7:0] signed_value;
  reg [7:0] unsigned_value;
  reg [3:0] amount;
  integer i;
  initial begin
    signed_value = 8'hb1;
    unsigned_value = signed_value;
    for (i = 0; i <= 9; i = i + 3)
      $display("shift %0d sl=%b sal=%b sr=%b sar=%b ur=%b", i, signed_value << i, signed_value <<< i, signed_value >> i, signed_value >>> i, unsigned_value >>> i);
    amount = 4'b00x1;
    $display("unknown_amount %b %b %b %b", signed_value << amount, signed_value <<< amount, signed_value >> amount, signed_value >>> amount);
    signed_value = 8'bz101_x011;
    $display("zsign %b %b %b", signed_value >>> 2, signed_value >> 2, signed_value << 2);
    signed_value = 8'bx101_0011;
    $display("xsign %b", signed_value >>> 3);
    $finish;
  end
endmodule
