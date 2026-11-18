module top;
  genvar i;
  for(i=0;i<1;i=i+1) begin : A end
  if(1) begin initial $display("%m"); end
endmodule
