module tb;
  reg signed [7:0] negative, positive;
  reg [3:0] small_unsigned;
  reg signed [15:0] signed_result, mixed_result;
  reg [15:0] unsigned_result;
  initial begin
    negative = -3;
    positive = 3;
    small_unsigned = 3;
    signed_result = negative + positive;
    mixed_result = negative + small_unsigned;
    unsigned_result = negative + positive;
    $display("add signed=%h mixed=%h destination_unsigned=%h", signed_result, mixed_result, unsigned_result);
    $display("compare signed=%b mixed=%b", negative < positive, negative < small_unsigned);
    $display("divide signed=%0d mixed=%0d", negative / positive, negative / small_unsigned);
    $display("remainder signed=%0d mixed=%0d", negative % positive, negative % small_unsigned);
    $display("equal_width %b %b", 4'shf == 8'shff, 4'shf == 8'hff);
    $finish;
  end
endmodule
