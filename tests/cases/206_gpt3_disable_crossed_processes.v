module top;
integer hits=0;
initial begin
  begin : first
    #5;
  end
  disable second;
end
initial begin : second
  #1 disable first;
  #2 hits=1;
end
initial #6 $display("%0d",hits);
endmodule
