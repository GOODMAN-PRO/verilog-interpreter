module leaf(output o, input en, input d); assign o = en ? d : 1'bz; pullup(o); endmodule
module mid(output o, input en, input d); leaf l(o, en, d); endmodule
module t;
  wire w, v; reg en, d, r;
  mid m(w, en, d);
  assign w = r;
  leaf l2(v, en, d);
  pulldown(v);
  initial begin
    en = 0; d = 0; r = 1'bz; #1 $display("%b %b", w, v);
    r = 0; #1 $display("%b %b", w, v);
    r = 1'bz; en = 1; #1 $display("%b %b", w, v);
    d = 1; r = 0; #1 $display("%b %b", w, v);
  end
endmodule
