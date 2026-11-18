module tb;
  parameter WIDTH = 7;
  parameter signed [7:0] NEGATIVE = -8'sd9;
  parameter [15:0] PATTERN = 16'h1234;
  parameter real SCALE = 2.5;
  localparam DEPTH = 1 << 4;
  localparam ADDRESS_BITS = $clog2(DEPTH);
  localparam [WIDTH-1:0] MASK = {WIDTH{1'b1}};
  reg [WIDTH-1:0] value;
  initial begin
    value = MASK;
    $display("params %0d %0d %h %0.2f", WIDTH, NEGATIVE, PATTERN, SCALE);
    $display("derived %0d %0d %h", DEPTH, ADDRESS_BITS, value);
    $display("clog2 %0d %0d %0d %0d %0d", $clog2(0), $clog2(1), $clog2(2), $clog2(3), $clog2(17));
    $display("bits %0d %0d %0d", $bits(WIDTH), $bits(NEGATIVE), $bits(MASK));
    $finish;
  end
endmodule
