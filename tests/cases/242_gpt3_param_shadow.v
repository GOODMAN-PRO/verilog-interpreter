module top;
  parameter P=7;
  if(1) begin:g
    reg P;
    localparam N=P;
    initial $display("%0d",N);
  end
endmodule
