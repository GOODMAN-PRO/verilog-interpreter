module leaf(inout a, input drive, input val);
  assign a = drive ? val : 1'bz;
endmodule
module mid(inout [1:0] bus, input [1:0] dr, input [1:0] v);
  leaf l0(bus[0], dr[0], v[0]);
  leaf l1(bus[1], dr[1], v[1]);
  pullup (bus[1]);
endmodule
module tb;
  wire [3:0] w; reg [1:0] dr, v; reg top_en;
  mid m(w[2:1], dr, v);
  assign w[2:1] = top_en ? 2'b00 : 2'bzz;
  pulldown (w[0]);
  tri1 [3:3] hi; assign w[3] = hi;
  initial begin
    dr = 0; v = 0; top_en = 0;
    #1 $display("%b", w);
    dr = 2'b01; v = 2'b01; #1 $display("%b", w);
    dr = 2'b11; v = 2'b01; #1 $display("%b", w);
    top_en = 1; #1 $display("%b", w);
    dr = 0; #1 $display("%b", w);
    $display("%b %b", m.bus, m.l1.a);
  end
endmodule
