module top;
  localparam W=1;
  if (1) begin:g
    localparam [W-1:0] P=7;
    localparam W=3;
    initial $display("%b",P);
  end
endmodule
