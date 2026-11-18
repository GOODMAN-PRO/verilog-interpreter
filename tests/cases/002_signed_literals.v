module tb;
  reg signed [7:0] negative, minimum, positive;
  reg signed [15:0] extended;
  reg [15:0] unsigned_extended;
  initial begin
    negative = -8'sd5;
    minimum = 8'sh80;
    positive = +8'sd5;
    extended = 8'shf0;
    unsigned_extended = 8'hf0;
    $display("signed %0d %0d %0d", negative, minimum, positive);
    $display("literal %0d %0d %0d %0d", 8'sb11111011, 8'so373, 8'shfb, -5);
    $display("extend %h %h", extended, unsigned_extended);
    $display("unary %h %h %h", -8'd5, -8'sd5, +8'shfb);
    $display("width %0d %0d %0d", $bits(5), $bits('hff), $bits(8'sd5));
    $finish;
  end
endmodule
