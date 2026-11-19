module src(output wor [1:0] o, input [1:0] d); assign o = d; endmodule
module io(inout wor [1:0] o, input [1:0] d); assign o = d; endmodule
module s1b(output wor o, input d); assign o = d; endmodule
module i1b(inout wor o, input d); assign o = d; endmodule
module pu(output [1:0] o); pullup(o[0]); pullup(o[1]); endmodule
module t1(inout tri1 [1:0] o); endmodule
module t;
  wire [1:0] whole, wio; wire [3:0] part, pio, bits, bio, pp, pt, cc; wire x1, x2; reg [1:0] a, b;
  src s1(whole, a), s2(whole, b);
  io  i1(wio, a), i2(wio, b);
  src s3(part[1:0], a), s4(part[1:0], b);
  io  i3(pio[1:0], a), i4(pio[1:0], b);
  s1b s5(bits[0], a[0]), s6(bits[0], b[0]);
  i1b i5(bio[0], a[0]), i6(bio[0], b[0]);
  src s7({x1, x2}, a), s8({x1, x2}, b);
  pu p1(pp[2:1]);
  t1 q1(pt[2:1]);
  io i7(cc[3:2], a), i8(cc[3:2], b); src s9(cc[1:0], a), s10(cc[1:0], b);
  initial begin
    a = 0; b = 1; #1 $display("%b %b %b %b %b %b %b%b %b %b %b", whole, wio, part, pio, bits, bio, x1, x2, pp, pt, cc);
    a = 2; b = 1; #1 $display("%b %b %b %b %b %b %b%b %b %b %b", whole, wio, part, pio, bits, bio, x1, x2, pp, pt, cc);
  end
endmodule
