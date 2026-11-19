module drv(output [3:0] o, input [3:0] d, input en); assign o = en ? d : 4'bz; pullup(o[0]); pulldown(o[3]); endmodule
module t;
  wire [7:0] w; wire [1:0] n; reg [3:0] d; reg en; wire [3:0] z; supply0 gnd; supply1 vdd; wire [1:0] rails;
  drv a(w[5:2], d, en);
  drv b({n, w[1:0]}, d, en);
  drv c(z, d, 1'b0);
  assign rails = {vdd, gnd};
  assign w[7:6] = 2'b10;
  initial begin
    en = 0; d = 4'b0110; #1 $display("%b %b %b %b", w, n, z, rails);
    en = 1; #1 $display("%b %b %b %b", w, n, z, rails);
    d = 4'b1001; #1 $display("%b %b %b %b", w, n, z, rails);
  end
endmodule
