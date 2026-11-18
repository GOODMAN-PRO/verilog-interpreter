module tb;
  reg [15:0] down;
  reg [0:15] up;
  reg [24:9] offset;
  integer base;
  initial begin
    down = 16'hc39a;
    up = down;
    offset = down;
    for (base = 0; base <= 12; base = base + 4)
      $display("read %0d d+%h d-%h u+%h u-%h off%h", base, down[base +: 4], down[base+3 -: 4], up[base +: 4], up[base+3 -: 4], offset[base+9 +: 4]);
    base = 4;
    down[base +: 4] = 4'h5;
    up[base +: 4] = 4'h5;
    offset[base+9 +: 4] = 4'h5;
    $display("lhs_plus %h %h %h", down, up, offset);
    base = 11;
    down[base -: 4] = 4'h6;
    up[base -: 4] = 4'h6;
    offset[base+9 -: 4] = 4'h6;
    $display("lhs_minus %h %h %h", down, up, offset);
    $finish;
  end
endmodule
