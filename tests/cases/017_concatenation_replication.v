module tb;
  reg [3:0] a, b;
  reg [15:0] packed_value;
  reg carry;
  reg [6:0] low;
  initial begin
    a = 4'ha;
    b = 4'h3;
    packed_value = {a, b, {2{2'b10}}, 4'bx0z1};
    $display("concat %b", packed_value);
    $display("repeat %b %b", {3{a}}, {2{{2{2'b01}}, b}});
    {carry, low} = {a, b};
    $display("split %b %b", carry, low);
    {a[1:0], b[3:2]} = 4'b1101;
    $display("lhs %b %b", a, b);
    $display("unsigned_concat %b", {4'shf} < 4'sh1);
    $finish;
  end
endmodule
